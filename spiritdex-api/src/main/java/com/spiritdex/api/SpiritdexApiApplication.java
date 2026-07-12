package com.spiritdex.api;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.spiritdex.api.mapper")
@EnableScheduling
public class SpiritdexApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpiritdexApiApplication.class, args);
	}

}
