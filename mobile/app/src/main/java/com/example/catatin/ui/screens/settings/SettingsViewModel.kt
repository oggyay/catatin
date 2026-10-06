package com.example.catatin.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.SettingsApiService
import com.example.catatin.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface SettingsUiState {
    data object Loading : SettingsUiState
    data class Success(
        val profile: ProfileDto,
        val tenantSettings: TenantSettingsDto,
        val subscription: SubscriptionData,
        val whatsapp: WhatsappStatusDto,
        val members: List<UserSettingsDto> = emptyList()
    ) : SettingsUiState
    data class Error(val message: String) : SettingsUiState
}

class SettingsViewModel(
    private val settingsApiService: SettingsApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<SettingsUiState>(SettingsUiState.Loading)
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        loadSettingsData()
    }

    fun loadSettingsData() {
        viewModelScope.launch {
            _uiState.value = SettingsUiState.Loading
            try {
                val profileRes = settingsApiService.getProfile()
                val tenantRes = settingsApiService.getTenant()
                val subRes = settingsApiService.getSubscription()
                val waRes = settingsApiService.getWhatsappStatus()
                val membersRes = try {
                    if (tenantRes.data.type == "umkm") settingsApiService.getUsers().data else emptyList()
                } catch (e: Exception) {
                    emptyList() // Ignore member list fails if not premium/admin or simple tenant
                }

                _uiState.value = SettingsUiState.Success(
                    profile = profileRes.data,
                    tenantSettings = tenantRes.data,
                    subscription = subRes.data,
                    whatsapp = waRes.data,
                    members = membersRes
                )
            } catch (e: Exception) {
                _uiState.value = SettingsUiState.Error(e.message ?: "Gagal memuat pengaturan")
            }
        }
    }

    // Profile Settings
    fun updateProfile(name: String, phone: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.updateProfile(UpdateProfileRequest(name, phone))
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal memperbarui profil")
            }
        }
    }

    // Business Settings
    fun updateTenantSettings(name: String, type: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.updateTenant(UpdateTenantRequest(name, type))
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal memperbarui info bisnis")
            }
        }
    }

    // WhatsApp Bot Settings
    fun requestWhatsappLink(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.requestWhatsappLink()
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal mengirim permintaan tautan WhatsApp")
            }
        }
    }

    fun cancelWhatsappLink(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.cancelWhatsappLink()
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal membatalkan tautan WhatsApp")
            }
        }
    }

    fun unlinkWhatsapp(onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.unlinkWhatsapp()
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal melepas tautan WhatsApp")
            }
        }
    }

    // Member Settings (UMKM)
    fun createMember(name: String, waPhone: String, role: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                // Ensure proper WA formatting
                val formattedPhone = if (waPhone.startsWith("0")) {
                    "62" + waPhone.substring(1)
                } else if (!waPhone.startsWith("62")) {
                    "62" + waPhone
                } else {
                    waPhone
                }
                settingsApiService.createUser(CreateUserRequest(name, formattedPhone, role))
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal menambahkan anggota")
            }
        }
    }

    fun updateMember(id: String, role: String?, status: String?, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.updateUser(id, UpdateUserRequest(status = status, role = role))
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal mengubah status anggota")
            }
        }
    }

    fun deleteMember(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                settingsApiService.deleteUser(id)
                loadSettingsData()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal menghapus anggota")
            }
        }
    }
}
