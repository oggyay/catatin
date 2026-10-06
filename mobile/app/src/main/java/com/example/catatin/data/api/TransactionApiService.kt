package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.http.ContentType
import io.ktor.http.contentType

class TransactionApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    suspend fun getTransactions(
        page: Int = 1,
        pageSize: Int = 20,
        type: String? = null,
        accountId: String? = null,
        categoryId: String? = null,
        source: String? = null,
        status: String? = null,
        dateFrom: String? = null,
        dateTo: String? = null,
        q: String? = null
    ): TransactionListResponse {
        return client.get("transactions") {
            parameter("page", page)
            parameter("pageSize", pageSize)
            type?.let { parameter("type", it) }
            accountId?.let { parameter("accountId", it) }
            categoryId?.let { parameter("categoryId", it) }
            source?.let { parameter("source", it) }
            status?.let { parameter("status", it) }
            dateFrom?.let { parameter("dateFrom", it) }
            dateTo?.let { parameter("dateTo", it) }
            q?.let { parameter("q", it) }
        }.body()
    }

    suspend fun createTransaction(request: CreateTransactionRequest): GenericResponse {
        return client.post("transactions") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun updateTransaction(id: String, request: UpdateTransactionRequest): GenericResponse {
        return client.patch("transactions/$id") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun voidTransaction(id: String): GenericResponse {
        return client.post("transactions/$id/void").body()
    }

    suspend fun transfer(request: TransferRequest): GenericResponse {
        return client.post("transactions/transfer") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }
}
