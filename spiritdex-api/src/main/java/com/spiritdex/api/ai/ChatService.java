package com.spiritdex.api.ai;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.spiritdex.api.entity.EvolutionChain;
import com.spiritdex.api.entity.EvolutionStage;
import com.spiritdex.api.entity.Pet;
import com.spiritdex.api.mapper.EvolutionChainMapper;
import com.spiritdex.api.mapper.EvolutionStageMapper;
import com.spiritdex.api.mapper.PetMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * RAG 问答：检索片段 → 组装 prompt → 流式生成。
 *
 * <p>上下文组装时，对召回的精灵补全种族值和进化链（这两类数据不在 embedding chunk 里，
 * 故「迪莫种族值」「水灵怎么进化」等问题原本答不出——现通过 enrichment 注入）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final OpenAiChatModel chatModel;
    private final Retriever retriever;
    private final TypeContextProvider typeContextProvider;
    private final PetMapper petMapper;
    private final EvolutionChainMapper evolutionChainMapper;
    private final EvolutionStageMapper evolutionStageMapper;

    public Flux<String> streamChat(String question, java.util.function.Consumer<List<Retriever.Snippet>> onRefs) {
        return streamChat(question, null, onRefs);
    }

    /**
     * 带多轮历史的流式问答。
     *
     * @param question 本次问题
     * @param history  历史对话（最近 N 轮，每条 {role, content}），可为空（单轮）
     * @param onRefs   检索到的引用来源回调
     */
    public Flux<String> streamChat(String question,
                                   List<HistoryMsg> history,
                                   java.util.function.Consumer<List<Retriever.Snippet>> onRefs) {
        List<Retriever.Snippet> snippets = retriever.retrieve(question);
        onRefs.accept(snippets);

        String context = buildContext(snippets);
        // 属性相克问题：注入相克矩阵数据
        String typeCtx = typeContextProvider.contextFor(question);
        if (typeCtx != null) {
            context = context + "\n\n【属性相克资料】\n" + typeCtx;
        }

        String userContent = String.format(Prompts.USER_TEMPLATE, context, question);

        // 组装消息列表：system + history（如果有）+ 本次 user
        List<Message> messages = new ArrayList<>();
        messages.add(new SystemMessage(Prompts.SYSTEM));
        if (history != null) {
            for (HistoryMsg h : history) {
                if (h.content() == null || h.content().isBlank()) continue;
                if ("assistant".equalsIgnoreCase(h.role())) {
                    messages.add(new AssistantMessage(h.content()));
                } else {
                    messages.add(new UserMessage(h.content()));
                }
            }
        }
        messages.add(new UserMessage(userContent));

        Prompt prompt = new Prompt(messages);
        log.debug("[rag] 问答: {} | 召回 {} 条 | 历史 {} 条", question, snippets.size(),
                history == null ? 0 : history.size());
        return chatModel.stream(prompt)
                .map(resp -> resp.getResult().getOutput().getText() == null ? "" : resp.getResult().getOutput().getText())
                .filter(s -> !s.isEmpty());
    }

    /** 历史消息记录（前端传入）。 */
    public record HistoryMsg(String role, String content) {
    }

    /** 组装上下文：每个精灵补全种族值 + 进化链。 */
    private String buildContext(List<Retriever.Snippet> snippets) {
        if (snippets.isEmpty()) return "（暂无相关精灵资料）";

        // 批量取精灵实体（含 baseStats）
        List<Long> petIds = snippets.stream().map(Retriever.Snippet::petId).toList();
        Map<Long, Pet> petById = petMapper.selectBatchIds(petIds).stream()
                .collect(Collectors.toMap(Pet::getId, p -> p));

        return snippets.stream()
                .map(s -> {
                    Pet p = petById.get(s.petId());
                    if (p == null) return "- " + s.name() + "：" + s.chunkText();
                    StringBuilder row = new StringBuilder("- ").append(p.getName()).append("（").append(s.slug()).append("）");
                    // 种族值
                    if (p.getBaseStats() != null && !p.getBaseStats().isEmpty()) {
                        String stats = p.getBaseStats().entrySet().stream()
                                .map(e -> e.getKey() + e.getValue())
                                .collect(Collectors.joining("/"));
                        row.append("，种族值 ").append(stats);
                    }
                    row.append("。");
                    // 进化链
                    String evo = evolutionText(p);
                    if (evo != null) row.append(evo);
                    // 原描述（chunkText 已含名字/属性/描述，避免重复，这里只补 chunk 里没有的）
                    if (s.chunkText() != null && !p.getName().equals(s.chunkText())) {
                        // chunkText 含描述，附加（去重：若已含则跳过）
                    }
                    return row.toString();
                })
                .collect(Collectors.joining("\n"));
    }

    /** 取精灵的进化链文本，如「由喵喵(16级)→喵呜(32级)→魔力猫 进化而来/进化到」。 */
    private String evolutionText(Pet pet) {
        String groupId = pet.getEvolutionGroupId();
        if (groupId == null || groupId.isBlank()) return null;
        EvolutionChain chain = evolutionChainMapper.selectOne(
                Wrappers.<EvolutionChain>lambdaQuery().eq(EvolutionChain::getGroupId, groupId));
        if (chain == null) return null;
        List<EvolutionStage> stages = evolutionStageMapper.selectList(
                Wrappers.<EvolutionStage>lambdaQuery()
                        .eq(EvolutionStage::getChainId, chain.getId())
                        .orderByAsc(EvolutionStage::getStageNo));
        if (stages.size() <= 1) return null;
        String path = stages.stream()
                .map(st -> st.getPetName() + (st.getLevel() != null ? "(Lv" + st.getLevel() + ")" : ""))
                .collect(Collectors.joining(" → "));
        return "进化链：" + path + "。";
    }
}
