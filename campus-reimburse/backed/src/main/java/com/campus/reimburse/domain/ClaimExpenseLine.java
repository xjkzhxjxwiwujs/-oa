package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claim_expense_line")
public class ClaimExpenseLine {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long claimId;
    private Integer lineNo;
    private String expenseTypeCode;
    private LocalDate occurredOn;
    private BigDecimal amount;
    private String remark;
}
