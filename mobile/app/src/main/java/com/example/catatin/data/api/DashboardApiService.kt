package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

class DashboardApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    suspend fun getSummary(): DashboardSummaryResponse {
        return client.get("dashboard/summary").body()
    }

    suspend fun getRecentTransactions(limit: Int = 8): RecentTransactionsResponse {
        return client.get("dashboard/recent-transactions") {
            parameter("limit", limit)
        }.body()
    }
}
