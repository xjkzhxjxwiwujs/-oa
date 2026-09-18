package com.campus.reimburse.claim;

import com.campus.reimburse.common.BizException;
import com.campus.reimburse.common.LoginUser;
import com.campus.reimburse.common.SecurityUtils;
import com.campus.reimburse.domain.ClaimFile;
import com.campus.reimburse.domain.ClaimForm;
import com.campus.reimburse.file.StoragePort;
import com.campus.reimburse.mapper.ClaimFileMapper;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;

@RestController
@RequiredArgsConstructor
public class FileController {
    private final ClaimFileMapper fileMapper;
    private final ClaimService claimService;
    private final StoragePort storagePort;

    @GetMapping("/api/common/files/{id}")
    public void download(@PathVariable Long id, HttpServletResponse response) throws Exception {
        LoginUser me = SecurityUtils.requireUser();
        ClaimFile f = fileMapper.selectById(id);
        if (f == null || f.getActive() != 1) {
            throw new BizException(404, "文件不存在");
        }
        ClaimForm form = claimService.requireForm(f.getClaimId());
        if (!form.getApplicantId().equals(me.getId()) && !me.getRoles().contains("FINANCE")
                && !me.getRoles().contains("ADMIN") && !me.getRoles().contains("APPROVER")
                && !me.getRoles().contains("COLLEGE")) {
            throw new BizException(403, "无权下载");
        }
        response.setHeader(HttpHeaders.CONTENT_TYPE, f.getMime());
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + f.getFileName() + "\"");
        try (InputStream in = storagePort.get(f.getObjectKey())) {
            in.transferTo(response.getOutputStream());
        }
    }
}
