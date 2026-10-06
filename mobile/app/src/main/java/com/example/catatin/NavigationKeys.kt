package com.example.catatin

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object Login : NavKey

@Serializable
data class Register(val phone: String = "") : NavKey

@Serializable
data class VerifyOtp(val phone: String, val purpose: String) : NavKey

@Serializable
data object Dashboard : NavKey

@Serializable
data object Transactions : NavKey

@Serializable
data class NewTransaction(val type: String = "expense") : NavKey

@Serializable
data object Accounts : NavKey

@Serializable
data object Categories : NavKey

@Serializable
data object CashflowReport : NavKey

@Serializable
data object Settings : NavKey

@Serializable
data object SettingsProfile : NavKey

@Serializable
data object SettingsUsers : NavKey

@Serializable
data object SettingsSubscription : NavKey

@Serializable
data object SettingsWhatsapp : NavKey
