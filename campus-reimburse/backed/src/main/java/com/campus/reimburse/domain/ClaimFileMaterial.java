package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claim_file_material")
public class ClaimFileMaterial {
    @TableId(value = "file_id", type = IdType.INPUT)
    private Long fileId;
    private String materialCode;
}
