package com.example.catatin.data.api

import com.example.catatin.data.model.*
import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.http.ContentType
import io.ktor.http.contentType

class CategoryApiService(private val apiClient: ApiClient) {
    private val client get() = apiClient.httpClient

    suspend fun getCategories(): CategoryListResponse {
        return client.get("categories").body()
    }

    suspend fun createCategory(request: CreateCategoryRequest): GenericResponse {
        return client.post("categories") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun updateCategory(id: String, request: UpdateCategoryRequest): GenericResponse {
        return client.patch("categories/$id") {
            contentType(ContentType.Application.Json)
            setBody(request)
        }.body()
    }

    suspend fun deleteCategory(id: String): GenericResponse {
        return client.delete("categories/$id").body()
    }
}
