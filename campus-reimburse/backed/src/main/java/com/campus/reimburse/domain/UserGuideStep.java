package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_guide_step")
public class UserGuideStep {
    private Long progressId;
    private String stepKey;
    private LocalDateTime coveredAt;
}
