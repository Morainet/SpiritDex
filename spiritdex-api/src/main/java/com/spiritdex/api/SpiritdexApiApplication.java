package com.spiritdex.api;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.spiritdex.api.mapper")
public class SpiritdexApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpiritdexApiApplication.class, args);
	}

}
