package com.example.catatin.di

import com.example.catatin.data.api.*
import com.example.catatin.ui.screens.auth.*
import com.example.catatin.ui.screens.dashboard.DashboardViewModel
import com.example.catatin.ui.screens.accounts.AccountsViewModel
import com.example.catatin.ui.screens.categories.CategoriesViewModel
import com.example.catatin.ui.screens.transactions.TransactionsViewModel
import com.example.catatin.ui.screens.reports.ReportsViewModel
import com.example.catatin.ui.screens.settings.SettingsViewModel
import org.koin.android.ext.koin.androidContext
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module

val appModule = module {
    single { TokenManager(androidContext()) }
    single { ApiClient(get()) }
    single { AuthApiService(get()) }
    single { DashboardApiService(get()) }
    single { AccountApiService(get()) }
    single { CategoryApiService(get()) }
    single { TransactionApiService(get()) }
    single { ReportApiService(get()) }
    single { SettingsApiService(get()) }

    // ViewModels
    viewModel { AuthViewModel(get(), get()) }
    viewModel { LoginViewModel(get(), get()) }
    viewModel { RegisterViewModel(get()) }
    viewModel { VerifyOtpViewModel(get(), get()) }
    viewModel { DashboardViewModel(get()) }
    viewModel { AccountsViewModel(get()) }
    viewModel { CategoriesViewModel(get()) }
    viewModel { TransactionsViewModel(get(), get(), get()) }
    viewModel { ReportsViewModel(get()) }
    viewModel { SettingsViewModel(get()) }
}

