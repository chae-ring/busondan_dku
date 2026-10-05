# STAGE 1: Build the application using Gradle
# Use the official Eclipse Temurin image which is a supported OpenJDK build
FROM eclipse-temurin:21-jdk-jammy as builder

# Set the working directory
WORKDIR /app

# Copy the gradle wrapper and build files
COPY gradlew .
COPY gradle ./gradle
COPY build.gradle .
COPY settings.gradle .

# Copy the source code
COPY src ./src

# Make the gradlew script executable and build the application
# Using --no-daemon is recommended for CI/CD environments
RUN chmod +x ./gradlew && ./gradlew bootJar --no-daemon


# STAGE 2: Create the final lightweight runtime image
# Use the corresponding JRE image from Eclipse Temurin for a smaller footprint
FROM eclipse-temurin:21-jre-jammy

# Set the working directory
WORKDIR /app

# Copy only the built jar file from the builder stage
COPY --from=builder /app/build/libs/*.jar app.jar

# Expose the port the app runs on
EXPOSE 5001

# Set the entrypoint to run the application
ENTRYPOINT ["java", "-jar", "app.jar"]

