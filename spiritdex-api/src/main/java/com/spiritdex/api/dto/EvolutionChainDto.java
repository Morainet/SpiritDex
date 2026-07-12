package com.spiritdex.api.dto;

import lombok.Data;

import java.util.List;

/**
 * 进化链（详情页展示）。
 */
@Data
public class EvolutionChainDto {
    private String groupId;
    private String name;
    private List<EvolutionStageDto> stages;

    @Data
    public static class EvolutionStageDto {
        private Integer stageNo;
        /** 进化到本阶段所需等级（首阶为 null）。 */
        private Integer level;
        private String petSlug;
        private String petName;
        private String illustrationKey;
        private List<String> types;
    }
}
