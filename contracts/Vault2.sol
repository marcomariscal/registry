// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@yield-protocol/utils-v2/contracts/token/ERC20.sol";

/// @title Vault2
/// @author M
/// @notice Vault where users can deposit and withdraw their vault's balance of a specific token
/// @notice 1 to 1 token to vault shares are minted and burned
contract Vault2 is ERC20 {
    event Deposit(address sender, uint256 _amount);
    event Withdraw(address sender, uint256 _amount);

    IERC20 public token;
    mapping(address => uint256) public balances;

    constructor(
        address _token,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol, 18) {
        token = IERC20(_token);
    }

    /// @notice deposits _amount into the contract and updates the user's vault balance
    /// @notice distributes token representing vault balance
    /// @param _amount the amount to deposit
    function deposit(uint256 _amount) public {
        require(_amount > 0, "amount should be greater than 0");
        balances[msg.sender] += _amount;

        // mint vault share to user
        _mint(msg.sender, _amount);

        token.transferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _amount);
    }

    /// @notice withdraws _amount from the contract and updates the user's vault balance
    /// @dev ensure the _amount can be withdrawn and burn representative balance
    /// @param _amount the amount to withdraw
    function withdraw(uint256 _amount) public {
        uint256 balance = balances[msg.sender];
        require(balance >= _amount, "amount greater than vault balance");
        balances[msg.sender] = balance - _amount;

        // burn the vault share
        _burn(msg.sender, _amount);

        token.transfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _amount);
    }
}
