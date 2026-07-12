package com.spiritdex.api.controller;

import com.spiritdex.api.common.Result;
import com.spiritdex.api.dto.TypeDto;
import com.spiritdex.api.dto.TypeMatrixDto;
import com.spiritdex.api.service.TypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "属性")
@RestController
@RequestMapping("/api/types")
@RequiredArgsConstructor
public class TypeController {

    private final TypeService typeService;

    @Operation(summary = "属性列表（18 个）")
    @GetMapping
    public Result<List<TypeDto>> list() {
        return Result.success(typeService.listAll());
    }

    @Operation(summary = "属性相克矩阵（18×18）")
    @GetMapping("/matrix")
    public Result<TypeMatrixDto> matrix() {
        return Result.success(typeService.getMatrix());
    }
}
