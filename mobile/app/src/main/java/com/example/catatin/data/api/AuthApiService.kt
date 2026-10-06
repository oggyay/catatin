package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.http.ContentType
import io.ktor.http.contentType

class AuthApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    suspend fun requestOtp(request: OtpRequest): GenericResponse {
        return client.post("auth/request-otp") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun register(request: RegisterRequest): GenericResponse {
        return client.post("auth/register") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun verifyOtp(request: VerifyOtpRequest): AuthResponse {
        return client.post("auth/verify-otp") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun getMe(): MeResponse {
        return client.get("auth/me").body()
    }

    suspend fun switchTenant(request: SwitchTenantRequest): SwitchTenantResponse {
        return client.post("auth/switch-tenant") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun logout() {
        client.post("auth/logout")
    }

    suspend fun createTenant(request: CreateTenantRequest): GenericResponse {
        return client.post("auth/tenants") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun deleteTenant(tenantId: String): TokenResponse {
        return client.delete("auth/tenants/$tenantId").body()
    }
}
