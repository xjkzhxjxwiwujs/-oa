package com.campus.reimburse.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("travel_leg")
public class TravelLeg {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long claimId;
    private Integer sortNo;
    private String fromPlace;
    private String toPlace;
    private String transportCode;
    private LocalDate departDate;
}
