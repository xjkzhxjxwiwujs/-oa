package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("job_task")
public class JobTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String taskType;
    private String bizType;
    private Long bizId;
    private String dedupKey;
    private String payloadJson;
    private String status;
    private Integer attempts;
    private Integer maxAttempts;
    private LocalDateTime nextRunAt;
    private String leaseOwner;
    private String leaseToken;
    private LocalDateTime leaseUntil;
    private String lastError;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
