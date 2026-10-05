package org.busondan.busondan;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // 스케줄링 기능 활성화
@EnableJpaRepositories(basePackages = "org.busondan.busondan.repository")
public class BusInfoApplication {

    public static void main(String[] args) {
        SpringApplication.run(BusInfoApplication.class, args);
    }
}