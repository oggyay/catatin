package com.example.catatin.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.AuthApiService
import com.example.catatin.data.api.TokenManager
import com.example.catatin.data.model.VerifyOtpRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface VerifyOtpUiState {
    data object Idle : VerifyOtpUiState
    data object Loading : VerifyOtpUiState
    data object Success : VerifyOtpUiState
    data class Error(val message: String) : VerifyOtpUiState
}

class VerifyOtpViewModel(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<VerifyOtpUiState>(VerifyOtpUiState.Idle)
    val uiState: StateFlow<VerifyOtpUiState> = _uiState.asStateFlow()

    private val _code = MutableStateFlow("")
    val code: StateFlow<String> = _code.asStateFlow()

    fun updateCode(newCode: String) {
        if (newCode.length <= 6) {
            _code.value = newCode
        }
    }

    fun verifyOtp(phone: String, onSuccess: () -> Unit) {
        val otpCode = _code.value.trim()
        if (otpCode.length != 6) {
            _uiState.value = VerifyOtpUiState.Error("Kode OTP harus terdiri dari 6 digit")
            return
        }

        viewModelScope.launch {
            _uiState.value = VerifyOtpUiState.Loading
            try {
                val response = authApiService.verifyOtp(VerifyOtpRequest(whatsappNumber = phone, code = otpCode))
                tokenManager.saveToken(response.token)
                _uiState.value = VerifyOtpUiState.Success
                onSuccess()
            } catch (e: Exception) {
                _uiState.value = VerifyOtpUiState.Error(e.message ?: "Kode OTP salah atau telah kedaluwarsa")
            }
        }
    }

    fun clearError() {
        _uiState.value = VerifyOtpUiState.Idle
    }
}
