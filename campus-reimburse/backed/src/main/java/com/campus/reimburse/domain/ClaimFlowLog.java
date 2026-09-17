package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claim_flow_log")
public class ClaimFlowLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long claimId;
    private Integer workflowRound;
    private String nodeCode;
    private String action;
    private Long operatorId;
    private String comment;
    private String requestId;
    private LocalDateTime createdAt;
}
