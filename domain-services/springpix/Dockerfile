# ----------------------
# Stage 1: Build
# ----------------------
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /src

# Cache dependencies separately from source changes
COPY app/pom.xml ./
RUN mvn dependency:go-offline

COPY app/src ./src
RUN mvn package -DskipTests

# ----------------------
# Stage 2: Runtime
# ----------------------
FROM eclipse-temurin:25-jre-alpine AS runtime
WORKDIR /app

# eclipse-temurin's alpine variant lags behind Alpine's package repo the
# same way nginx/taskfusion's did - upgrading in-place at build time
# picks up whatever's actually current instead of waiting on the base
# image tag to be rebuilt.
RUN apk update && apk upgrade --no-cache

COPY --from=build /src/target/springpix-0.0.1-SNAPSHOT.jar springpix.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "springpix.jar"]
