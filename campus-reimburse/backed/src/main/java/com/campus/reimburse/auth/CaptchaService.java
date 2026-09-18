package com.campus.reimburse.auth;

import com.campus.reimburse.common.BizException;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class CaptchaService {
    public static final String SESSION_CODE = "LOGIN_CAPTCHA";
    public static final String SESSION_AT = "LOGIN_CAPTCHA_AT";
    private static final String CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final long TTL_MS = 3 * 60 * 1000L;
    private final SecureRandom random = new SecureRandom();

    public Map<String, Object> issue(HttpSession session) {
        String code = randomCode(4);
        session.setAttribute(SESSION_CODE, code);
        session.setAttribute(SESSION_AT, System.currentTimeMillis());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("image", "data:image/png;base64," + render(code));
        m.put("ttlSeconds", 180);
        return m;
    }

    public void verifyAndConsume(HttpSession session, String input) {
        if (input == null || input.isBlank()) {
            throw new BizException(400, "请输入验证码");
        }
        Object saved = session.getAttribute(SESSION_CODE);
        Object at = session.getAttribute(SESSION_AT);
        session.removeAttribute(SESSION_CODE);
        session.removeAttribute(SESSION_AT);
        if (saved == null) {
            throw new BizException(400, "请先获取验证码");
        }
        long started = at instanceof Number n ? n.longValue() : 0L;
        if (started > 0 && System.currentTimeMillis() - started > TTL_MS) {
            throw new BizException(400, "验证码已过期，请刷新");
        }
        if (!saved.toString().equalsIgnoreCase(input.trim())) {
            throw new BizException(400, "验证码错误");
        }
    }

    private String randomCode(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }

    private String render(String code) {
        int w = 132;
        int h = 44;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(new Color(238, 242, 255));
        g.fillRect(0, 0, w, h);
        for (int i = 0; i < 6; i++) {
            g.setColor(new Color(46, 91, 255, 40 + random.nextInt(50)));
            g.drawLine(random.nextInt(w), random.nextInt(h), random.nextInt(w), random.nextInt(h));
        }
        g.setFont(new Font("SansSerif", Font.BOLD, 26));
        for (int i = 0; i < code.length(); i++) {
            g.setColor(new Color(23, 60, 180));
            int x = 14 + i * 28;
            int y = 30 + random.nextInt(5) - 2;
            g.drawString(String.valueOf(code.charAt(i)), x, y);
        }
        for (int i = 0; i < 28; i++) {
            g.setColor(new Color(46, 91, 255, 50));
            g.fillRect(random.nextInt(w), random.nextInt(h), 1, 1);
        }
        g.dispose();
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", out);
            return Base64.getEncoder().encodeToString(out.toByteArray());
        } catch (Exception e) {
            throw new BizException(500, "验证码生成失败");
        }
    }
}
