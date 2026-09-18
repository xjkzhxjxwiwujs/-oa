package com.campus.reimburse.claim;

import com.campus.reimburse.common.BizException;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.DataExport;
import com.campus.reimburse.domain.JobTask;
import com.campus.reimburse.domain.SysAuditLog;
import com.campus.reimburse.mapper.DataExportMapper;
import com.campus.reimburse.mapper.JobTaskMapper;
import com.campus.reimburse.mapper.SysAuditLogMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExportService {
    private final ClaimService claimService;
    private final JobTaskMapper jobTaskMapper;
    private final DataExportMapper dataExportMapper;
    private final SysAuditLogMapper auditLogMapper;

    public void exportFinance(String format, HttpServletResponse response) throws Exception {
        LoginUser me = SecurityUtils.requireUser();
        if (!me.getRoles().contains("FINANCE") && !me.getRoles().contains("ADMIN")) {
            throw new BizException(403, "仅财务可导出");
        }
        String fmt = format == null ? "xlsx" : format.toLowerCase();
        if (!List.of("xlsx", "csv", "json").contains(fmt)) {
            throw new BizException("仅支持 xlsx/csv/json");
        }
        List<Map<String, Object>> rows = claimService.financeList();
        JobTask job = new JobTask();
        job.setTaskType("EXPORT");
        job.setBizType("FINANCE_LIST");
        job.setDedupKey("export-" + me.getId() + "-" + System.currentTimeMillis());
        job.setStatus("SUCCEEDED");
        job.setAttempts(1);
        job.setMaxAttempts(3);
        job.setNextRunAt(LocalDateTime.now());
        job.setPayloadJson("{\"format\":\"" + fmt + "\",\"rows\":" + rows.size() + "}");
        jobTaskMapper.insert(job);

        DataExport exp = new DataExport();
        exp.setRequesterId(me.getId());
        exp.setFormat(fmt);
        exp.setScopeType("FINANCE");
        exp.setFilterJson("{\"claimType\":\"TRAVEL_CLAIM\"}");
        exp.setColumnsJson("[\"claimNo\",\"claimType\",\"applicantName\",\"status\",\"currentNode\",\"amount\",\"createdAt\"]");
        exp.setPermissionVersion(me.getPermissionVersion() == null ? 1 : me.getPermissionVersion());
        exp.setCutoffAt(LocalDateTime.now());
        exp.setRowCount(rows.size());
        exp.setJobId(job.getId());
        exp.setCreatedAt(LocalDateTime.now());
        exp.setFinishedAt(LocalDateTime.now());
        dataExportMapper.insert(exp);

        SysAuditLog log = new SysAuditLog();
        log.setActorId(me.getId());
        log.setAction("EXPORT");
        log.setSuccess(1);
        log.setDetail(fmt + ":" + rows.size());
        log.setCreatedAt(LocalDateTime.now());
        auditLogMapper.insert(log);

        String[] headers = {"claimNo", "claimType", "applicantName", "status", "currentNode", "amount", "createdAt"};
        switch (fmt) {
            case "csv" -> {
                response.setContentType("text/csv;charset=UTF-8");
                response.setHeader("Content-Disposition", "attachment; filename=finance.csv");
                response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});
                try (CSVPrinter p = new CSVPrinter(new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8),
                        CSVFormat.DEFAULT.builder().setHeader(headers).get())) {
                    for (Map<String, Object> r : rows) {
                        p.printRecord(r.get("claimNo"), r.get("claimType"), r.get("applicantName"), r.get("status"),
                                r.get("currentNode"), r.get("amount"), r.get("createdAt"));
                    }
                }
            }
            case "json" -> {
                response.setContentType("application/json;charset=UTF-8");
                response.setHeader("Content-Disposition", "attachment; filename=finance.json");
                java.util.List<Map<String, Object>> items = new java.util.ArrayList<>();
                for (Map<String, Object> r : rows) {
                    Map<String, Object> item = new java.util.LinkedHashMap<>();
                    item.put("claimNo", r.get("claimNo"));
                    item.put("applicantName", r.get("applicantName"));
                    item.put("amount", r.get("amount"));
                    item.put("status", r.get("status"));
                    item.put("submittedAt", r.get("createdAt"));
                    items.add(item);
                }
                Map<String, Object> body = new java.util.LinkedHashMap<>();
                body.put("exportedAt", LocalDateTime.now().toString());
                body.put("cutoffAt", LocalDateTime.now().toString());
                body.put("items", items);
                new com.fasterxml.jackson.databind.ObjectMapper()
                        .findAndRegisterModules()
                        .writeValue(response.getOutputStream(), body);
            }
            default -> {
                response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                response.setHeader("Content-Disposition", "attachment; filename=finance.xlsx");
                try (SXSSFWorkbook wb = new SXSSFWorkbook(100)) {
                    SXSSFSheet sh = wb.createSheet("报销清单");
                    Row h = sh.createRow(0);
                    for (int i = 0; i < headers.length; i++) {
                        h.createCell(i).setCellValue(headers[i]);
                    }
                    int rownum = 1;
                    for (Map<String, Object> r : rows) {
                        Row row = sh.createRow(rownum++);
                        row.createCell(0).setCellValue(str(r.get("claimNo")));
                        row.createCell(1).setCellValue(str(r.get("claimType")));
                        row.createCell(2).setCellValue(str(r.get("applicantName")));
                        row.createCell(3).setCellValue(str(r.get("status")));
                        row.createCell(4).setCellValue(str(r.get("currentNode")));
                        row.createCell(5).setCellValue(str(r.get("amount")));
                        row.createCell(6).setCellValue(str(r.get("createdAt")));
                    }
                    wb.write(response.getOutputStream());
                    wb.dispose();
                }
            }
        }
    }

    private String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
