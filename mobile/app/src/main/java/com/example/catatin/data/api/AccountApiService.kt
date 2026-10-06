package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.http.ContentType
import io.ktor.http.contentType

class AccountApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    suspend fun getAccounts(): AccountListResponse {
        return client.get("accounts").body()
    }

    suspend fun createAccount(request: CreateAccountRequest): GenericResponse {
        return client.post("accounts") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun updateAccount(id: String, request: UpdateAccountRequest): GenericResponse {
        return client.patch("accounts/$id") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun deleteAccount(id: String): GenericResponse {
        return client.delete("accounts/$id").body()
    }

    suspend fun adjustBalance(id: String, request: AdjustBalanceRequest): GenericResponse {
        return client.post("accounts/$id/adjust-balance") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
}
