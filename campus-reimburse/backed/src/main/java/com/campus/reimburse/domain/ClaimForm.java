package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claim_form")
public class ClaimForm {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String claimNo;
    private String claimType;
    private Long applicantId;
    private Long deptId;
    private Long wfTemplateId;
    private String status;
    private String currentNode;
    private Integer version;
    private Integer workflowRound;
    private BigDecimal amount;
    private String invoiceCheckStatus;
    private Integer materialRuleVersion;
    private Long sourceApplyId;
    private LocalDateTime submittedAt;
    private LocalDateTime finishedAt;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
