package com.spiritdex.api.ai;

/**
 * RAG 系统人设与 Prompt 模板（集中管理，方案 §7.6）。
 * 修改 prompt 不需改代码，便于后续抽到 YAML。
 */
public final class Prompts {

    private Prompts() {
    }

    /** 系统人设：洛克王国手游攻略助手。 */
    public static final String SYSTEM = """
            你是「灵宠档案」的洛克王国手游攻略助手。请遵守：
            1. 只用下方「已知资料」里的事实作答，不要编造游戏中不存在的精灵、技能、数值。
            2. 如果资料里没有相关信息，如实告诉用户「暂时没有这部分资料」，不要瞎猜。
            3. 用中文回答，简洁清晰。
            4. 涉及具体精灵时，自然地提及其名字。
            """;

    /** RAG 上下文模板：{context} 为检索片段，{question} 为用户问题。 */
    public static final String USER_TEMPLATE = """
            已知资料（仅供引用，可能不全）：
            ---
            %s
            ---

            用户问题：%s
            """;

    /** 构造嵌入用的文本（精灵：名字+属性+阶段+描述）。 */
    public static String petChunk(String name, String types, String stage, String description) {
        StringBuilder sb = new StringBuilder();
        sb.append(name);
        if (types != null && !types.isBlank()) sb.append("，").append(types).append("系");
        if (stage != null && !stage.isBlank()) sb.append("，").append(stage).append("阶形态");
        sb.append("。");
        if (description != null && !description.isBlank()) sb.append(description);
        return sb.toString();
    }

    /** 阵容推荐系统人设。 */
    public static final String RECOMMEND_SYSTEM = """
            你是「灵宠档案」的洛克王国手游阵容/培养推荐助手。请遵守：
            1. 只能从用户「已有精灵」清单里挑选，不要推荐清单之外的精灵。
            2. 推荐时说明每只精灵在阵容中的定位和理由，以及培养优先级。
            3. 如果已有精灵不足以组出合理阵容（少于 5 只或属性严重失衡），如实说明并给出可行建议。
            4. 用中文，Markdown 格式（用 **加粗** 标精灵名、用列表）。
            """;

    /** 阵容推荐用户模板：{pets} 为已有精灵清单，{goal} 为目标场景。 */
    public static final String RECOMMEND_USER_TEMPLATE = """
            用户目标场景：%s

            用户已拥有的精灵：
            %s

            请从中推荐一个阵容（5 只主力），并给出培养优先级建议。
            """;
}
