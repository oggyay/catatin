package com.example.catatin.data.model

import kotlinx.serialization.Serializable

// Auth
@Serializable data class OtpRequest(val whatsappNumber: String, val purpose: String = "login")
@Serializable data class RegisterRequest(val name: String, val whatsappNumber: String, val businessName: String, val type: String = "personal")
@Serializable data class VerifyOtpRequest(val whatsappNumber: String, val code: String)
@Serializable data class AuthResponse(val user: UserDto, val token: String)
@Serializable data class UserDto(
    val id: String = "",
    val name: String = "",
    val role: String = "",
    val tenantId: String = "",
    val whatsappNumber: String = "",
    val whatsappLinked: Boolean = false,
    val status: String = "active",
    val tenant: TenantInfo? = null
)
@Serializable data class TenantInfo(
    val name: String = "",
    val type: String = "personal",
    val subscriptionPlan: String = "free",
    val subscriptionStatus: String = "trial",
    val trialEndsAt: String? = null
)
@Serializable data class TenantListItem(val tenantId: String, val tenantName: String, val tenantType: String = "personal")
@Serializable data class MeResponse(val user: UserDto, val tenants: List<TenantListItem> = emptyList())
@Serializable data class SwitchTenantRequest(val tenantId: String)
@Serializable data class SwitchTenantResponse(val token: String)
@Serializable data class CreateTenantRequest(val name: String, val type: String = "personal")

// Dashboard
@Serializable data class DashboardSummary(
    val totalBalance: Double = 0.0,
    val monthIncome: Double = 0.0,
    val monthExpense: Double = 0.0,
    val netCashflow: Double = 0.0
)
@Serializable data class DashboardSummaryResponse(val data: DashboardSummary)
@Serializable data class RecentTransactionsResponse(val data: List<TransactionDto>)

// Accounts
@Serializable data class AccountDto(
    val id: String = "",
    val name: String = "",
    val type: String = "cash",
    val openingBalance: Double = 0.0,
    val currentBalance: Double = 0.0,
    val isDefault: Boolean = false,
    val status: String = "active"
)
@Serializable data class AccountListResponse(val data: List<AccountDto>)
@Serializable data class CreateAccountRequest(val name: String, val type: String, val openingBalance: Double = 0.0, val isDefault: Boolean = false)
@Serializable data class UpdateAccountRequest(val name: String? = null, val type: String? = null, val isDefault: Boolean? = null, val status: String? = null)
@Serializable data class AdjustBalanceRequest(val realBalance: Double, val reason: String, val transactionDate: String)

// Categories
@Serializable data class CategoryDto(
    val id: String = "",
    val name: String = "",
    val type: String = "expense",
    val isDefault: Boolean = false,
    val status: String = "active"
)
@Serializable data class CategoryListResponse(val data: List<CategoryDto>)
@Serializable data class CreateCategoryRequest(val name: String, val type: String)
@Serializable data class UpdateCategoryRequest(val name: String? = null, val status: String? = null)

// Transactions
@Serializable data class TransactionDto(
    val id: String = "",
    val type: String = "expense",
    val amount: Double = 0.0,
    val description: String? = null,
    val transactionDate: String = "",
    val source: String = "web",
    val status: String = "active",
    val transferGroupId: String? = null,
    val transferDirection: String? = null,
    val attachmentUrl: String? = null,
    val createdAt: String = "",
    val account: AccountDto? = null,
    val category: CategoryDto? = null,
    val user: TransactionUserDto? = null
)
@Serializable data class TransactionUserDto(val name: String = "")
@Serializable data class TransactionListResponse(
    val data: List<TransactionDto>,
    val pagination: PaginationDto? = null
)
@Serializable data class PaginationDto(
    val page: Int = 1,
    val pageSize: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 0
)
@Serializable data class CreateTransactionRequest(
    val type: String,
    val amount: Double,
    val accountId: String,
    val categoryId: String? = null,
    val transactionDate: String,
    val description: String? = null
)
@Serializable data class UpdateTransactionRequest(
    val amount: Double? = null,
    val accountId: String? = null,
    val categoryId: String? = null,
    val transactionDate: String? = null
)
@Serializable data class TransferRequest(
    val fromAccountId: String,
    val toAccountId: String,
    val amount: Double,
    val description: String? = null,
    val transactionDate: String
)

// Reports
@Serializable data class CashflowReport(
    val totalIncome: Double = 0.0,
    val totalExpense: Double = 0.0,
    val netCashflow: Double = 0.0,
    val incomeByCategory: List<CategoryBreakdown> = emptyList(),
    val expenseByCategory: List<CategoryBreakdown> = emptyList(),
    val perAccount: List<AccountBreakdown> = emptyList()
)
@Serializable data class CashflowReportResponse(val data: CashflowReport)
@Serializable data class CategoryBreakdown(
    val categoryId: String? = null,
    val categoryName: String = "Tanpa Kategori",
    val total: Double = 0.0,
    val count: Int = 0
)
@Serializable data class AccountBreakdown(
    val accountId: String = "",
    val accountName: String = "",
    val accountType: String = "cash",
    val income: Double = 0.0,
    val expense: Double = 0.0,
    val net: Double = 0.0,
    val currentBalance: Double = 0.0
)

// Settings
@Serializable data class ProfileResponse(val data: ProfileDto)
@Serializable data class ProfileDto(val name: String = "", val whatsappNumber: String = "")
@Serializable data class UpdateProfileRequest(val name: String, val whatsappNumber: String)
@Serializable data class TenantSettingsResponse(val data: TenantSettingsDto)
@Serializable data class TenantSettingsDto(
    val name: String = "",
    val type: String = "personal",
    val subscriptionPlan: String = "free",
    val subscriptionStatus: String = "trial"
)
@Serializable data class UpdateTenantRequest(val name: String, val type: String)
@Serializable data class UserSettingsDto(
    val id: String = "",
    val name: String = "",
    val whatsappNumber: String = "",
    val role: String = "member",
    val status: String = "active"
)
@Serializable data class UserListResponse(val data: List<UserSettingsDto>)
@Serializable data class CreateUserRequest(val name: String, val whatsappNumber: String, val role: String = "member")
@Serializable data class UpdateUserRequest(val status: String? = null, val role: String? = null)
@Serializable data class SubscriptionResponse(val data: SubscriptionData)
@Serializable data class SubscriptionData(
    val tenant: SubscriptionTenant = SubscriptionTenant(),
    val usage: SubscriptionUsage = SubscriptionUsage(),
    val limits: SubscriptionLimits = SubscriptionLimits()
)
@Serializable data class SubscriptionTenant(
    val subscriptionPlan: String = "free",
    val subscriptionStatus: String = "trial",
    val type: String = "personal",
    val trialEndsAt: String? = null,
    val trialExpired: Boolean = false
)
@Serializable data class SubscriptionUsage(val users: Int = 0, val accounts: Int = 0)
@Serializable data class SubscriptionLimits(val maxUsers: Int = 1, val maxAccounts: Int = 3, val whatsappBot: Boolean = false)
@Serializable data class WhatsappStatusResponse(val data: WhatsappStatusDto)
@Serializable data class WhatsappStatusDto(
    val linked: Boolean = false,
    val whatsappNumber: String? = null,
    val whatsappJid: String? = null,
    val activeRequest: WhatsappActiveRequest? = null
)
@Serializable data class WhatsappActiveRequest(val whatsappNumber: String = "", val expiresAt: String = "")
@Serializable data class GenericResponse(val message: String = "")
@Serializable data class TokenResponse(val token: String)
