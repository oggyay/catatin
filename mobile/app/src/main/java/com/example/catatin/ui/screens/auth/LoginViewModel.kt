package com.example.catatin.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.AuthApiService
import com.example.catatin.data.api.TokenManager
import com.example.catatin.data.model.OtpRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface LoginUiState {
    data object Idle : LoginUiState
    data object Loading : LoginUiState
    data object Success : LoginUiState
    data class Error(val message: String) : LoginUiState
}

class LoginViewModel(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    fun updatePhone(newPhone: String) {
        _phone.value = newPhone
    }

    fun requestOtp(onSuccess: (String) -> Unit) {
        val currentPhone = _phone.value.trim()
        if (currentPhone.length < 9) {
            _uiState.value = LoginUiState.Error("Nomor WhatsApp tidak valid (minimal 9 digit)")
            return
        }

        viewModelScope.launch {
            _uiState.value = LoginUiState.Loading
            try {
                // Ensure proper Indonesian format e.g. 62...
                val formattedPhone = if (currentPhone.startsWith("0")) {
                    "62" + currentPhone.substring(1)
                } else if (!currentPhone.startsWith("62")) {
                    "62" + currentPhone
                } else {
                    currentPhone
                }

                authApiService.requestOtp(OtpRequest(whatsappNumber = formattedPhone, purpose = "login"))
                tokenManager.savePhone(formattedPhone)
                _uiState.value = LoginUiState.Success
                onSuccess(formattedPhone)
            } catch (e: Exception) {
                _uiState.value = LoginUiState.Error(e.message ?: "Gagal mengirim OTP. Pastikan server aktif.")
            }
        }
    }

    fun clearError() {
        _uiState.value = LoginUiState.Idle
    }
}
