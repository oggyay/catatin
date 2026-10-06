package com.example.catatin.ui.screens.transactions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.catatin.data.api.AccountApiService
import com.example.catatin.data.api.CategoryApiService
import com.example.catatin.data.api.TransactionApiService
import com.example.catatin.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface TransactionsUiState {
    data object Loading : TransactionsUiState
    data class Success(
        val transactions: List<TransactionDto>,
        val pagination: PaginationDto?,
        val accounts: List<AccountDto>,
        val categories: List<CategoryDto>
    ) : TransactionsUiState
    data class Error(val message: String) : TransactionsUiState
}

class TransactionsViewModel(
    private val transactionApiService: TransactionApiService,
    private val accountApiService: AccountApiService,
    private val categoryApiService: CategoryApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow<TransactionsUiState>(TransactionsUiState.Loading)
    val uiState: StateFlow<TransactionsUiState> = _uiState.asStateFlow()

    // Filters
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _selectedType = MutableStateFlow<String?>(null) // null = all, expense, income, transfer
    val selectedType: StateFlow<String?> = _selectedType.asStateFlow()

    private val _selectedAccountId = MutableStateFlow<String?>(null)
    val selectedAccountId: StateFlow<String?> = _selectedAccountId.asStateFlow()

    private val _selectedCategoryId = MutableStateFlow<String?>(null)
    val selectedCategoryId: StateFlow<String?> = _selectedCategoryId.asStateFlow()

    private var currentPage = 1
    private var accountsCached = emptyList<AccountDto>()
    private var categoriesCached = emptyList<CategoryDto>()

    init {
        loadInitialData()
    }

    fun loadInitialData() {
        viewModelScope.launch {
            _uiState.value = TransactionsUiState.Loading
            try {
                accountsCached = accountApiService.getAccounts().data
                categoriesCached = categoryApiService.getCategories().data
                loadTransactions()
            } catch (e: Exception) {
                _uiState.value = TransactionsUiState.Error(e.message ?: "Gagal memuat data awal transaksi")
            }
        }
    }

    fun loadTransactions(page: Int = 1) {
        currentPage = page
        viewModelScope.launch {
            try {
                // If it is already Success, don't trigger loading to avoid layout flickering during filtering
                val currentSuccessState = _uiState.value as? TransactionsUiState.Success
                if (currentSuccessState == null) {
                    _uiState.value = TransactionsUiState.Loading
                }

                // If type is "transfer", since the backend transactions endpoint might not have explicit "transfer" type,
                // we handle it or just query normal list. Let's pass type.
                val queryType = if (_selectedType.value == "transfer") null else _selectedType.value
                val response = transactionApiService.getTransactions(
                    page = page,
                    q = _searchQuery.value.ifBlank { null },
                    type = queryType,
                    accountId = _selectedAccountId.value,
                    categoryId = _selectedCategoryId.value
                )

                // If type is transfer, we might want to filter only transfer transactions on frontend (e.g. transferGroupId != null)
                val filteredData = if (_selectedType.value == "transfer") {
                    response.data.filter { it.transferGroupId != null }
                } else {
                    response.data
                }

                _uiState.value = TransactionsUiState.Success(
                    transactions = filteredData,
                    pagination = response.pagination,
                    accounts = accountsCached,
                    categories = categoriesCached
                )
            } catch (e: Exception) {
                _uiState.value = TransactionsUiState.Error(e.message ?: "Gagal memuat data transaksi")
            }
        }
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
        loadTransactions()
    }

    fun updateSelectedType(type: String?) {
        _selectedType.value = type
        loadTransactions()
    }

    fun updateSelectedAccount(accountId: String?) {
        _selectedAccountId.value = accountId
        loadTransactions()
    }

    fun updateSelectedCategory(categoryId: String?) {
        _selectedCategoryId.value = categoryId
        loadTransactions()
    }

    fun voidTransaction(id: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                transactionApiService.voidTransaction(id)
                loadTransactions(currentPage)
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal membatalkan transaksi")
            }
        }
    }

    fun createTransaction(
        type: String,
        amount: Double,
        accountId: String,
        categoryId: String?,
        date: String,
        description: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                transactionApiService.createTransaction(
                    CreateTransactionRequest(
                        type = type,
                        amount = amount,
                        accountId = accountId,
                        categoryId = categoryId,
                        transactionDate = date,
                        description = description
                    )
                )
                loadTransactions()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal mencatat transaksi")
            }
        }
    }

    fun transfer(
        fromAccountId: String,
        toAccountId: String,
        amount: Double,
        description: String?,
        date: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            try {
                transactionApiService.transfer(
                    TransferRequest(
                        fromAccountId = fromAccountId,
                        toAccountId = toAccountId,
                        amount = amount,
                        description = description,
                        transactionDate = date
                    )
                )
                loadTransactions()
                onSuccess()
            } catch (e: Exception) {
                onError(e.message ?: "Gagal melakukan transfer uang")
            }
        }
    }
}
