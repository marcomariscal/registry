// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Vault1
/// @author M
/// @notice Vault where users can deposit and withdraw their vault's balance of a specific token
contract Vault1 {
    event Deposit(address sender, uint256 _amount);
    event Withdraw(address sender, uint256 _amount);

    IERC20 public token;
    mapping(address => uint256) public balances;

    constructor(address _token) {
        token = IERC20(_token);
    }

    /// @notice deposits _amount into the contract and updates the balances mapping
    /// @dev ensure this is the proper approval pattern
    /// @param _amount the amount to deposit
    function deposit(uint256 _amount) public {
        require(token.balanceOf(msg.sender) >= _amount, "not enough token balance");
        require(_amount > 0, "amount should be greater than 0");
        token.approve(msg.sender, _amount);
        balances[msg.sender] += _amount;

        emit Deposit(msg.sender, _amount);
    }

    /// @notice withdraws _amount from the contract and updates the balances mapping
    /// @param _amount the amount to withdraw
    function withdraw(uint256 _amount) public {
        uint256 balance = balances[msg.sender];
        require(balance >= _amount, "amount greater than vault balance");
        balances[msg.sender] = balance - _amount;

        emit Withdraw(msg.sender, _amount);
    }
}
