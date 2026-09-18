package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("data_export")
public class DataExport {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long requesterId;
    private String format;
    private String scopeType;
    private String filterJson;
    private String columnsJson;
    private Integer permissionVersion;
    private LocalDateTime cutoffAt;
    private String fileObjectKey;
    private Integer rowCount;
    private LocalDateTime expiresAt;
    private Long jobId;
    private LocalDateTime createdAt;
    private LocalDateTime finishedAt;
}
