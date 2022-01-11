// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@yield-protocol/utils-v2/contracts/token/IERC20.sol";

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
        require(_amount > 0, "amount should be greater than 0");

        // state change before transfer to prevent re-entrancy
        balances[msg.sender] += _amount;

        token.transferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount);
    }

    /// @notice withdraws _amount from the contract and updates the balances mapping
    /// @dev ensure the _amount can be withdrawn
    /// @param _amount the amount to withdraw
    function withdraw(uint256 _amount) public {
        uint256 balance = balances[msg.sender];
        require(balance >= _amount, "amount greater than vault balance");
        balances[msg.sender] = balance - _amount;

        token.transfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _amount);
    }
}
