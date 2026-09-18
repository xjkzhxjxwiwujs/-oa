package com.campus.reimburse.claim;

import com.campus.reimburse.common.BizException;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.ClaimForm;
import com.lowagie.text.Document;
import com.lowagie.text.Font;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfWriter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PdfService {
    private final ClaimService claimService;

    public void write(Long id, HttpServletResponse response) throws Exception {
        LoginUser me = SecurityUtils.requireUser();
        Map<String, Object> d = claimService.detail(id);
        ClaimForm form = (ClaimForm) d.get("form");
        if (!form.getApplicantId().equals(me.getId()) && !me.getRoles().contains("FINANCE") && !me.getRoles().contains("ADMIN")) {
            throw new BizException(403, "无权导出");
        }
        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=" + form.getClaimNo() + ".pdf");
        BaseFont bf;
        try {
            bf = BaseFont.createFont("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc,0", BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
        } catch (Exception e) {
            bf = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
        }
        Font font = new Font(bf, 12);
        Document doc = new Document();
        PdfWriter.getInstance(doc, response.getOutputStream());
        doc.open();
        if ("DRAFT".equals(form.getStatus())) {
            doc.add(new Paragraph("【草稿】", font));
        }
        doc.add(new Paragraph("校园智能报销审批平台", font));
        doc.add(new Paragraph("单号：" + form.getClaimNo(), font));
        doc.add(new Paragraph("类型：" + form.getClaimType(), font));
        doc.add(new Paragraph("状态：" + form.getStatus(), font));
        doc.add(new Paragraph("申请人：" + d.get("applicantName"), font));
        if (d.get("reason") != null || d.get("apply") != null) {
            Object apply = d.get("apply");
            if (apply != null) {
                doc.add(new Paragraph("申请信息：" + apply, font));
            }
        }
        if (d.get("projectCode") != null) {
            doc.add(new Paragraph("项目：" + d.get("projectCode") + " " + d.get("projectName"), font));
        }
        @SuppressWarnings("unchecked")
        List<ClaimDtos.TimelineNode> tl = (List<ClaimDtos.TimelineNode>) d.get("timeline");
        doc.add(new Paragraph("审批轨迹：", font));
        if (tl != null) {
            for (ClaimDtos.TimelineNode n : tl) {
                doc.add(new Paragraph("- " + n.getNodeName() + " " + n.getState() + " " + (n.getAssigneeName() == null ? "" : n.getAssigneeName()), font));
            }
        }
        doc.close();
    }
}
