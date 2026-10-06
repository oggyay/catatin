package com.example.catatin.ui.screens.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.ReportApiService
import com.example.catatin.data.model.CashflowReport
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface ReportsUiState {
    data object Loading : ReportsUiState
    data class Success(val report: CashflowReport) : ReportsUiState
    data class Error(val message: String) : ReportsUiState
}

class ReportsViewModel(
    private val reportApiService: ReportApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<ReportsUiState>(ReportsUiState.Loading)
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    private val _selectedPeriod = MutableStateFlow("this_month")
    val selectedPeriod: StateFlow<String> = _selectedPeriod.asStateFlow()

    init {
        loadReport()
    }

    fun updatePeriod(period: String) {
        _selectedPeriod.value = period
        loadReport()
    }

    fun loadReport() {
        viewModelScope.launch {
            _uiState.value = ReportsUiState.Loading
            try {
                val response = reportApiService.getCashflowReport(period = _selectedPeriod.value)
                _uiState.value = ReportsUiState.Success(response.data)
            } catch (e: Exception) {
                _uiState.value = ReportsUiState.Error(e.message ?: "Gagal memuat laporan keuangan")
            }
        }
    }
}
