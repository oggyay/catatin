package com.example.catatin.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.DashboardApiService
import com.example.catatin.data.model.DashboardSummary
import com.example.catatin.data.model.TransactionDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface DashboardUiState {
    data object Loading : DashboardUiState
    data class Success(
        val summary: DashboardSummary,
        val recentTransactions: List<TransactionDto>
    ) : DashboardUiState
    data class Error(val message: String) : DashboardUiState
}

class DashboardViewModel(
    private val dashboardApiService: DashboardApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun loadDashboardData() {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            try {
                val summaryResponse = dashboardApiService.getSummary()
                val recentTransactionsResponse = dashboardApiService.getRecentTransactions()
                _uiState.value = DashboardUiState.Success(
                    summary = summaryResponse.data,
                    recentTransactions = recentTransactionsResponse.data
                )
            } catch (e: Exception) {
                _uiState.value = DashboardUiState.Error(e.message ?: "Gagal memuat data dashboard. Silakan coba lagi.")
            }
        }
    }
}
