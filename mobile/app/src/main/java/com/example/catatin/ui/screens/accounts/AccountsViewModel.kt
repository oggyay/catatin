package com.example.catatin.ui.screens.accounts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.AccountApiService
import com.example.catatin.data.model.AccountDto
import com.example.catatin.data.model.AdjustBalanceRequest
import com.example.catatin.data.model.CreateAccountRequest
import com.example.catatin.data.model.UpdateAccountRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AccountsUiState {
    data object Loading : AccountsUiState
    data class Success(val accounts: List<AccountDto>) : AccountsUiState
    data class Error(val message: String) : AccountsUiState
}

class AccountsViewModel(
    private val accountApiService: AccountApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<AccountsUiState>(AccountsUiState.Loading)
    val uiState: StateFlow<AccountsUiState> = _uiState.asStateFlow()

    init {
        loadAccounts()
    }

    fun loadAccounts() {
        viewModelScope.launch {
            _uiState.value = AccountsUiState.Loading
            try {
                val response = accountApiService.getAccounts()
                _uiState.value = AccountsUiState.Success(response.data)
            } catch (e: Exception) {
                _uiState.value = AccountsUiState.Error(e.message ?: "Gagal memuat daftar rekening")
            }
        }
    }

    fun createAccount(name: String, type: String, openingBalance: Double, isDefault: Boolean, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                accountApiService.createAccount(CreateAccountRequest(name, type, openingBalance, isDefault))
                loadAccounts()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal membuat rekening baru")
            }
        }
    }

    fun updateAccount(id: String, name: String, type: String, isDefault: Boolean, status: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                accountApiService.updateAccount(id, UpdateAccountRequest(name, type, isDefault, status))
                loadAccounts()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal memperbarui rekening")
            }
        }
    }

    fun deleteAccount(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                accountApiService.deleteAccount(id)
                loadAccounts()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal menghapus rekening")
            }
        }
    }

    fun adjustBalance(id: String, realBalance: Double, reason: String, date: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                accountApiService.adjustBalance(id, AdjustBalanceRequest(realBalance, reason, date))
                loadAccounts()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal menyesuaikan saldo")
            }
        }
    }
}
