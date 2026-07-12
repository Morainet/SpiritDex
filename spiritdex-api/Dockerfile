# 灵宠档案后端 Dockerfile（多阶段构建）
# 构建：docker build -t spiritdex-api .
# 运行：docker run -p 8080:8080 \
#   -e SPRING_DATASOURCE_URL=jdbc:postgresql://<db-host>:5432/spiritdex \
#   -e SPRING_DATASOURCE_USERNAME=... -e SPRING_DATASOURCE_PASSWORD=... \
#   -e GLM_API_KEY=... -e SPIRITDEX_CORS_ORIGINS=https://your-domain \
#   spiritdex-api

# 阶段1：构建
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q package -DskipTests

# 阶段2：运行（精简 JRE）
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
