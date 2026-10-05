package org.busondan.busondan.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

import java.io.Console;
import java.io.IOException;
import java.time.Duration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;

@Configuration
@Slf4j
public class AppConfig {

    @Value("${app.cors.allowed-origins:http://localhost:3000}")
    private String allowedOriginsString;

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder restTemplateBuilder) {
        return restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
    }


    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule()); // Java 8 날짜/시간 타입 지원
        return mapper;
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                String[] allowedOrigins = allowedOriginsString.split(",");
                for (int i = 0; i < allowedOrigins.length; i++) {
                    log.debug("CORS allowed origin: " + allowedOrigins[i]);
                }
                registry.addMapping("/**") // 모든 경로에 대해
                        .allowedOrigins(allowedOrigins) // 허용할 Origin
                        .allowedMethods("GET", "POST", "PUT", "DELETE")
                        .allowCredentials(false);
            }
        };
    }

    @Bean
    public Filter removeVaryOriginAndAddCacheControl() {
        return new Filter() {
            @Override
            public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                    throws IOException, ServletException {

                chain.doFilter(request, response);

                HttpServletResponse res = (HttpServletResponse) response;

                // Vary: Origin 제거
                String vary = res.getHeader("Vary");
                if (vary != null) {
                    vary = vary.replace("Origin", "").replaceAll(",,", ",");
                    vary = vary.replaceAll("^,|,$", "").trim();
                    if (vary.isEmpty()) {
                        res.setHeader("Vary", "Accept-Encoding"); // Accept-Encoding만 남김
                    } else {
                        res.setHeader("Vary", vary);
                    }
                } else {
                    res.setHeader("Vary", "Accept-Encoding");
                }

                // Cache-Control 추가 (GET 요청만)
                if ("GET".equalsIgnoreCase(((HttpServletRequest) request).getMethod())) {
                    res.setHeader("Cache-Control", "public, max-age=60"); // Edge TTL 60초
                }
            }
        };
    }
    // @Bean
    // public WebMvcConfigurer corsConfigurer() {
    //     return new WebMvcConfigurer() {
    //         @Override
    //         public void addCorsMappings(CorsRegistry registry) {
    //             registry.addMapping("/**") // 모든 경로
    //                     .allowedOriginPatterns("*") // 모든 Origin 허용
    //                     .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // 필요한 HTTP 메소드 추가
    //                     .allowCredentials(true); // 인증 정보(쿠키 등) 허용할 경우
    //         }
    //     };
    // }
}