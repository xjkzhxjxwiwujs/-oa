package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("travel_claim")
public class TravelClaim {
    @TableId(value = "claim_id", type = IdType.INPUT)
    private Long claimId;
    private String payeeAccountEnc;
    private String payeeBank;
    private Integer encKeyVersion;
}
