package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.HttpResponse

class ReportApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    suspend fun getCashflowReport(
        period: String? = null,
        dateFrom: String? = null,
        dateTo: String? = null
    ): CashflowReportResponse {
        return client.get("reports/cashflow") {
            period?.let { parameter("period", it) }
            dateFrom?.let { parameter("dateFrom", it) }
            dateTo?.let { parameter("dateTo", it) }
        }.body()
    }

    suspend fun exportCashflow(
        period: String? = null,
        dateFrom: String? = null,
        dateTo: String? = null
    ): HttpResponse {
        return client.get("reports/cashflow/export") {
            period?.let { parameter("period", it) }
            dateFrom?.let { parameter("dateFrom", it) }
            dateTo?.let { parameter("dateTo", it) }
        }
    }
}
