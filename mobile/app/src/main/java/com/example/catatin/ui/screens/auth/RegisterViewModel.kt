package com.example.catatin.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.AuthApiService
import com.example.catatin.data.model.RegisterRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface RegisterUiState {
    data object Idle : RegisterUiState
    data object Loading : RegisterUiState
    data object Success : RegisterUiState
    data class Error(val message: String) : RegisterUiState
}

class RegisterViewModel(
    private val authApiService: AuthApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<RegisterUiState>(RegisterUiState.Idle)
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    private val _name = MutableStateFlow("")
    val name: StateFlow<String> = _name.asStateFlow()

    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    private val _businessName = MutableStateFlow("")
    val businessName: StateFlow<String> = _businessName.asStateFlow()

    private val _businessType = MutableStateFlow("personal") // "personal" or "umkm"
    val businessType: StateFlow<String> = _businessType.asStateFlow()

    fun updateName(value: String) { _name.value = value }
    fun updatePhone(value: String) { _phone.value = value }
    fun updateBusinessName(value: String) { _businessName.value = value }
    fun updateBusinessType(value: String) { _businessType.value = value }

    fun register(onSuccess: (String) -> Unit) {
        val currentName = _name.value.trim()
        val currentPhone = _phone.value.trim()
        val currentBusiness = _businessName.value.trim()
        
        if (currentName.isEmpty() || currentPhone.isEmpty() || currentBusiness.isEmpty()) {
            _uiState.value = RegisterUiState.Error("Semua field wajib diisi")
            return
        }

        if (currentPhone.length < 9) {
            _uiState.value = RegisterUiState.Error("Nomor WhatsApp tidak valid (minimal 9 digit)")
            return
        }

        viewModelScope.launch {
            _uiState.value = RegisterUiState.Loading
            try {
                val formattedPhone = if (currentPhone.startsWith("0")) {
                    "62" + currentPhone.substring(1)
                } else if (!currentPhone.startsWith("62")) {
                    "62" + currentPhone
                } else {
                    currentPhone
                }

                authApiService.register(
                    RegisterRequest(
                        name = currentName,
                        whatsappNumber = formattedPhone,
                        businessName = currentBusiness,
                        type = _businessType.value
                    )
                )
                
                _uiState.value = RegisterUiState.Success
                onSuccess(formattedPhone)
            } catch (e: Exception) {
                _uiState.value = RegisterUiState.Error(e.message ?: "Registrasi gagal. Coba nomor lain.")
            }
        }
    }

    fun clearError() {
        _uiState.value = RegisterUiState.Idle
    }
}
