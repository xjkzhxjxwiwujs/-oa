package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claim_file")
public class ClaimFile {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long claimId;
    private String objectKey;
    private String fileName;
    private String mime;
    private Long sizeBytes;
    private String sha256;
    private Long uploaderId;
    private Integer active;
    private LocalDateTime createdAt;
}
