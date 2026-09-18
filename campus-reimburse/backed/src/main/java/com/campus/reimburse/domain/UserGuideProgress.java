package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("user_guide_progress")
public class UserGuideProgress {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String featureKey;
    private Integer guideVersion;
    private String status;
    private String currentStepKey;
    private String runId;
    private Integer rowVersion;
    private LocalDateTime firstStartedAt;
    private LocalDateTime completedAt;
    private LocalDateTime skippedAt;
}
