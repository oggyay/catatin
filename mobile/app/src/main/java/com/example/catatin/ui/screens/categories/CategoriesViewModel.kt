package com.example.catatin.ui.screens.categories

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.CategoryApiService
import com.example.catatin.data.model.CategoryDto
import com.example.catatin.data.model.CreateCategoryRequest
import com.example.catatin.data.model.UpdateCategoryRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface CategoriesUiState {
    data object Loading : CategoriesUiState
    data class Success(val categories: List<CategoryDto>) : CategoriesUiState
    data class Error(val message: String) : CategoriesUiState
}

class CategoriesViewModel(
    private val categoryApiService: CategoryApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<CategoriesUiState>(CategoriesUiState.Loading)
    val uiState: StateFlow<CategoriesUiState> = _uiState.asStateFlow()

    init {
        loadCategories()
    }

    fun loadCategories() {
        viewModelScope.launch {
            _uiState.value = CategoriesUiState.Loading
            try {
                val response = categoryApiService.getCategories()
                _uiState.value = CategoriesUiState.Success(response.data)
            } catch (e: Exception) {
                _uiState.value = CategoriesUiState.Error(e.message ?: "Gagal memuat daftar kategori")
            }
        }
    }

    fun createCategory(name: String, type: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                categoryApiService.createCategory(CreateCategoryRequest(name, type))
                loadCategories()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal membuat kategori baru")
            }
        }
    }

    fun updateCategory(id: String, name: String, status: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                categoryApiService.updateCategory(id, UpdateCategoryRequest(name, status))
                loadCategories()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal memperbarui kategori")
            }
        }
    }

    fun deleteCategory(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                categoryApiService.deleteCategory(id)
                loadCategories()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal menghapus kategori")
            }
        }
    }
}
