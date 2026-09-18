package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("travel_apply")
public class TravelApply {
    @TableId(value = "claim_id", type = IdType.INPUT)
    private Long claimId;
    private Long projectId;
    private String reason;
    private LocalDate startDate;
    private LocalDate endDate;
    private String remark;
}
