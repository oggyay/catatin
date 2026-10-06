package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.http.ContentType
import io.ktor.http.contentType

class SettingsApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    // Profile
    suspend fun getProfile(): ProfileResponse = client.get("settings/profile").body()
    suspend fun updateProfile(request: UpdateProfileRequest): GenericResponse {
        return client.patch("settings/profile") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    // Tenant
    suspend fun getTenant(): TenantSettingsResponse = client.get("settings/tenant").body()
    suspend fun updateTenant(request: UpdateTenantRequest): GenericResponse {
        return client.patch("settings/tenant") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    // Users
    suspend fun getUsers(): UserListResponse = client.get("settings/users").body()
    suspend fun createUser(request: CreateUserRequest): GenericResponse {
        return client.post("settings/users") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    suspend fun updateUser(id: String, request: UpdateUserRequest): GenericResponse {
        return client.patch("settings/users/$id") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
    suspend fun deleteUser(id: String): GenericResponse = client.delete("settings/users/$id").body()

    // Subscription
    suspend fun getSubscription(): SubscriptionResponse = client.get("settings/subscription").body()

    // WhatsApp
    suspend fun getWhatsappStatus(): WhatsappStatusResponse = client.get("settings/whatsapp").body()
    suspend fun requestWhatsappLink(): GenericResponse {
        return client.post("settings/whatsapp/link-request").body()
    }
    suspend fun cancelWhatsappLink(): GenericResponse {
        return client.delete("settings/whatsapp/link-request").body()
    }
    suspend fun unlinkWhatsapp(): GenericResponse {
        return client.delete("settings/whatsapp/link").body()
    }
}
