package com.example.catatin.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.AuthApiService
import com.example.catatin.data.api.TokenManager
import com.example.catatin.data.model.CreateTenantRequest
import com.example.catatin.data.model.SwitchTenantRequest
import com.example.catatin.data.model.UserDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AuthState {
    data object Checking : AuthState
    data object Unauthenticated : AuthState
    data class Authenticated(val user: UserDto, val tenants: List<com.example.catatin.data.model.TenantListItem>) : AuthState
    data class Error(val message: String) : AuthState
}

class AuthViewModel(
    private val authApiService: AuthApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Checking)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    init {
        checkLoginStatus()
    }

    fun checkLoginStatus() {
        viewModelScope.launch {
            _authState.value = AuthState.Checking
            val token = tokenManager.getToken()
            if (token.isNullOrEmpty()) {
                _authState.value = AuthState.Unauthenticated
            } else {
                fetchCurrentUser()
            }
        }
    }

    private suspend fun fetchCurrentUser() {
        try {
            val response = authApiService.getMe()
            _authState.value = AuthState.Authenticated(response.user, response.tenants)
        } catch (e: Exception) {
            // Token might be invalid or server down
            _authState.value = AuthState.Unauthenticated
        }
    }

    fun switchTenant(tenantId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                val response = authApiService.switchTenant(SwitchTenantRequest(tenantId))
                tokenManager.saveToken(response.token)
                fetchCurrentUser()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal mengganti bisnis")
            }
        }
    }

    fun createTenant(name: String, type: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                authApiService.createTenant(CreateTenantRequest(name, type))
                fetchCurrentUser() // refresh to get new list
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal membuat bisnis baru")
            }
        }
    }

    fun logout(onSuccess: () -> Unit) {
        viewModelScope.launch {
            try {
                authApiService.logout()
            } catch (e: Exception) {
                // Ignore network error on logout
            } finally {
                tokenManager.clearToken()
                tokenManager.clearPhone()
                _authState.value = AuthState.Unauthenticated
                onSuccess()
            }
        }
    }
}
