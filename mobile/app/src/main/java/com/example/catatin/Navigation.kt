package com.example.catatin

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.catatin.theme.CatatinColors
import com.example.catatin.ui.components.LoadingState
import com.example.catatin.ui.screens.auth.*
import com.example.catatin.ui.screens.dashboard.DashboardScreen
import com.example.catatin.ui.screens.accounts.AccountsScreen
import com.example.catatin.ui.screens.categories.CategoriesScreen
import com.example.catatin.ui.screens.transactions.TransactionsScreen
import com.example.catatin.ui.screens.transactions.NewTransactionScreen
import com.example.catatin.ui.screens.reports.CashflowReportScreen
import com.example.catatin.ui.screens.settings.*
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun MainNavigation(
    authViewModel: AuthViewModel = koinViewModel()
) {
    val authState by authViewModel.authState.collectAsState()

    when (val state = authState) {
        is AuthState.Checking -> {
            LoadingState()
        }
        is AuthState.Unauthenticated -> {
            AuthNavigationFlow(
                onAuthSuccess = { authViewModel.checkLoginStatus() }
            )
        }
        is AuthState.Authenticated -> {
            AppNavigationFlow(
                onLogoutSuccess = { authViewModel.checkLoginStatus() }
            )
        }
        is AuthState.Error -> {
            Box(modifier = Modifier.fillMaxSize()) {
                Text("Terjadi kesalahan sistem: ${state.message}", color = CatatinColors.Danger)
            }
        }
    }
}

@Composable
fun AuthNavigationFlow(
    onAuthSuccess: () -> Unit
) {
    val authBackStack = rememberNavBackStack(Login)

    NavDisplay(
        backStack = authBackStack,
        onBack = { authBackStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<Login> {
                LoginScreen(
                    onNavigateToRegister = { authBackStack.add(Register()) },
                    onNavigateToVerifyOtp = { phone -> authBackStack.add(VerifyOtp(phone = phone, purpose = "login")) }
                )
            }
            entry<Register> { key ->
                RegisterScreen(
                    onNavigateToLogin = { authBackStack.removeLastOrNull() },
                    onNavigateToVerifyOtp = { phone -> authBackStack.add(VerifyOtp(phone = phone, purpose = "register")) }
                )
            }
            entry<VerifyOtp> { key ->
                VerifyOtpScreen(
                    phone = key.phone,
                    onBack = { authBackStack.removeLastOrNull() },
                    onVerificationSuccess = onAuthSuccess
                )
            }
        }
    )
}

@Composable
fun AppNavigationFlow(
    onLogoutSuccess: () -> Unit
) {
    val appBackStack = rememberNavBackStack(Dashboard)
    val currentDestination = appBackStack.lastOrNull() ?: Dashboard

    // Helper to identify which bottom tab is currently selected
    val selectedTab = when (currentDestination) {
        is Dashboard -> 0
        is Transactions -> 1
        is CashflowReport -> 2
        is Settings -> 3
        else -> -1 // Nested sub-pages
    }

    Scaffold(
        bottomBar = {
            if (selectedTab != -1) {
                NavigationBar(
                    containerColor = CatatinColors.Surface,
                    contentColor = CatatinColors.Primary
                ) {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = {
                            appBackStack.clear()
                            appBackStack.add(Dashboard)
                        },
                        icon = { Icon(Icons.Default.Dashboard, contentDescription = "Beranda") },
                        label = { Text("Beranda") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = {
                            appBackStack.clear()
                            appBackStack.add(Transactions)
                        },
                        icon = { Icon(Icons.Default.ReceiptLong, contentDescription = "Transaksi") },
                        label = { Text("Transaksi") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = {
                            appBackStack.clear()
                            appBackStack.add(CashflowReport)
                        },
                        icon = { Icon(Icons.Default.BarChart, contentDescription = "Laporan") },
                        label = { Text("Laporan") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 3,
                        onClick = {
                            appBackStack.clear()
                            appBackStack.add(Settings)
                        },
                        icon = { Icon(Icons.Default.Settings, contentDescription = "Pengaturan") },
                        label = { Text("Pengaturan") }
                    )
                }
            }
        },
        containerColor = CatatinColors.Background
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            NavDisplay(
                backStack = appBackStack,
                onBack = { appBackStack.removeLastOrNull() },
                entryProvider = entryProvider {
                    entry<Dashboard> {
                        DashboardScreen(
                            onNavigateToNewTransaction = { type -> appBackStack.add(NewTransaction(type = type)) },
                            onNavigateToTransactions = {
                                appBackStack.clear()
                                appBackStack.add(Transactions)
                            },
                            onNavigateToAccounts = { appBackStack.add(Accounts) },
                            onNavigateToCategories = { appBackStack.add(Categories) },
                            onNavigateToReports = {
                                appBackStack.clear()
                                appBackStack.add(CashflowReport)
                            }
                        )
                    }
                    entry<Transactions> {
                        TransactionsScreen(
                            onBack = {
                                appBackStack.clear()
                                appBackStack.add(Dashboard)
                            },
                            onNavigateToNewTransaction = { type -> appBackStack.add(NewTransaction(type = type)) }
                        )
                    }
                    entry<NewTransaction> { key ->
                        NewTransactionScreen(
                            initialType = key.type,
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                    entry<Accounts> {
                        AccountsScreen(
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                    entry<Categories> {
                        CategoriesScreen(
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                    entry<CashflowReport> {
                        CashflowReportScreen(
                            onBack = {
                                appBackStack.clear()
                                appBackStack.add(Dashboard)
                            }
                        )
                    }
                    entry<Settings> {
                        SettingsScreen(
                            onNavigateToProfile = { appBackStack.add(SettingsProfile) },
                            onNavigateToWhatsapp = { appBackStack.add(SettingsWhatsapp) },
                            onNavigateToUsers = { appBackStack.add(SettingsUsers) },
                            onNavigateToSubscription = { appBackStack.add(SettingsSubscription) },
                            onLogoutSuccess = onLogoutSuccess
                        )
                    }
                    entry<SettingsProfile> {
                        SettingsProfileScreen(
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                    entry<SettingsWhatsapp> {
                        SettingsWhatsappScreen(
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                    entry<SettingsUsers> {
                        SettingsUsersScreen(
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                    entry<SettingsSubscription> {
                        SettingsSubscriptionScreen(
                            onBack = { appBackStack.removeLastOrNull() }
                        )
                    }
                }
            )
        }
    }
}
