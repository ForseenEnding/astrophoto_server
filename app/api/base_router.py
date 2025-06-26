from typing import Any, Dict, Optional, Type, List, Union
from fastapi import APIRouter, Depends, HTTPException, status
from app.utils.logging_config import get_logger
from app.utils.response_helpers import handle_service_error, create_success_response
from app.models.common_models import SuccessResponse


class BaseAPIRouter:
    """Base class for API routers with common functionality"""
    
    def __init__(self, prefix: str, tags: List[Union[str, Any]]):
        self.router = APIRouter(prefix=prefix, tags=tags)
        self.logger = get_logger(f"api.{prefix.replace('/', '_')}")
    
    def get_router(self) -> APIRouter:
        """Get the FastAPI router instance"""
        return self.router
    
    def handle_operation(
        self,
        operation: str,
        service_method,
        *args,
        **kwargs
    ) -> SuccessResponse:
        """
        Handle a service operation with standardized error handling and logging.
        
        Args:
            operation: Human-readable operation description
            service_method: Service method to call
            *args: Arguments to pass to service method
            **kwargs: Keyword arguments to pass to service method
        
        Returns:
            SuccessResponse with operation result
        
        Raises:
            HTTPException: If the operation fails
        """
        self.logger.info(f"Starting operation: {operation}")
        
        try:
            result = service_method(*args, **kwargs)
            self.logger.info(f"Operation completed successfully: {operation}")
            
            # Handle different return types
            if isinstance(result, dict):
                return create_success_response(
                    message=f"{operation} completed successfully",
                    data=result
                )
            elif hasattr(result, 'model_dump'):
                # Pydantic model
                return create_success_response(
                    message=f"{operation} completed successfully",
                    data=result.model_dump()
                )
            else:
                return create_success_response(
                    message=f"{operation} completed successfully",
                    data={"result": result}
                )
                
        except Exception as e:
            self.logger.error(f"Operation failed: {operation} - {str(e)}")
            handle_service_error(e, operation)
            # This line will never be reached due to handle_service_error raising an exception
            return create_success_response(message="Operation failed", data={})
    
    def handle_list_operation(
        self,
        operation: str,
        service_method,
        *args,
        **kwargs
    ) -> SuccessResponse:
        """
        Handle a list operation with standardized response format.
        
        Args:
            operation: Human-readable operation description
            service_method: Service method to call
            *args: Arguments to pass to service method
            **kwargs: Keyword arguments to pass to service method
        
        Returns:
            SuccessResponse with list data
        """
        self.logger.info(f"Starting list operation: {operation}")
        
        try:
            items = service_method(*args, **kwargs)
            
            # Convert Pydantic models to dictionaries if needed
            if items and hasattr(items[0], 'model_dump'):
                data = [item.model_dump() for item in items]
            else:
                data = items
            
            self.logger.info(f"List operation completed: {operation} - {len(data)} items")
            
            return create_success_response(
                message=f"Retrieved {len(data)} items",
                data={"items": data, "count": len(data)}
            )
            
        except Exception as e:
            self.logger.error(f"List operation failed: {operation} - {str(e)}")
            handle_service_error(e, operation)
            # This line will never be reached due to handle_service_error raising an exception
            return create_success_response(message="List operation failed", data={})
    
    def handle_get_operation(
        self,
        operation: str,
        service_method,
        item_id: str,
        *args,
        **kwargs
    ) -> SuccessResponse:
        """
        Handle a get operation for a specific item.
        
        Args:
            operation: Human-readable operation description
            service_method: Service method to call
            item_id: ID of the item to retrieve
            *args: Additional arguments to pass to service method
            **kwargs: Keyword arguments to pass to service method
        
        Returns:
            SuccessResponse with item data
        """
        self.logger.info(f"Starting get operation: {operation} for {item_id}")
        
        try:
            item = service_method(item_id, *args, **kwargs)
            
            # Convert Pydantic model to dictionary if needed
            if hasattr(item, 'model_dump'):
                data = item.model_dump()
            else:
                data = item
            
            self.logger.info(f"Get operation completed: {operation} for {item_id}")
            
            return create_success_response(
                message=f"Retrieved {operation}",
                data=data
            )
            
        except Exception as e:
            self.logger.error(f"Get operation failed: {operation} for {item_id} - {str(e)}")
            handle_service_error(e, f"{operation} for {item_id}")
            # This line will never be reached due to handle_service_error raising an exception
            return create_success_response(message="Get operation failed", data={})
    
    def handle_create_operation(
        self,
        operation: str,
        service_method,
        *args,
        **kwargs
    ) -> SuccessResponse:
        """
        Handle a create operation.
        
        Args:
            operation: Human-readable operation description
            service_method: Service method to call
            *args: Arguments to pass to service method
            **kwargs: Keyword arguments to pass to service method
        
        Returns:
            SuccessResponse with created item data
        """
        self.logger.info(f"Starting create operation: {operation}")
        
        try:
            created_item = service_method(*args, **kwargs)
            
            # Convert Pydantic model to dictionary if needed
            if hasattr(created_item, 'model_dump'):
                data = created_item.model_dump()
            else:
                data = created_item
            
            self.logger.info(f"Create operation completed: {operation}")
            
            return create_success_response(
                message=f"{operation} created successfully",
                data=data
            )
            
        except Exception as e:
            self.logger.error(f"Create operation failed: {operation} - {str(e)}")
            handle_service_error(e, f"create {operation}")
            # This line will never be reached due to handle_service_error raising an exception
            return create_success_response(message="Create operation failed", data={})
    
    def handle_update_operation(
        self,
        operation: str,
        service_method,
        item_id: str,
        *args,
        **kwargs
    ) -> SuccessResponse:
        """
        Handle an update operation.
        
        Args:
            operation: Human-readable operation description
            service_method: Service method to call
            item_id: ID of the item to update
            *args: Additional arguments to pass to service method
            **kwargs: Keyword arguments to pass to service method
        
        Returns:
            SuccessResponse with updated item data
        """
        self.logger.info(f"Starting update operation: {operation} for {item_id}")
        
        try:
            updated_item = service_method(item_id, *args, **kwargs)
            
            # Convert Pydantic model to dictionary if needed
            if hasattr(updated_item, 'model_dump'):
                data = updated_item.model_dump()
            else:
                data = updated_item
            
            self.logger.info(f"Update operation completed: {operation} for {item_id}")
            
            return create_success_response(
                message=f"{operation} updated successfully",
                data=data
            )
            
        except Exception as e:
            self.logger.error(f"Update operation failed: {operation} for {item_id} - {str(e)}")
            handle_service_error(e, f"update {operation} for {item_id}")
            # This line will never be reached due to handle_service_error raising an exception
            return create_success_response(message="Update operation failed", data={})
    
    def handle_delete_operation(
        self,
        operation: str,
        service_method,
        item_id: str,
        *args,
        **kwargs
    ) -> SuccessResponse:
        """
        Handle a delete operation.
        
        Args:
            operation: Human-readable operation description
            service_method: Service method to call
            item_id: ID of the item to delete
            *args: Additional arguments to pass to service method
            **kwargs: Keyword arguments to pass to service method
        
        Returns:
            SuccessResponse with deletion confirmation
        """
        self.logger.info(f"Starting delete operation: {operation} for {item_id}")
        
        try:
            service_method(item_id, *args, **kwargs)
            
            self.logger.info(f"Delete operation completed: {operation} for {item_id}")
            
            return create_success_response(
                message=f"{operation} deleted successfully"
            )
            
        except Exception as e:
            self.logger.error(f"Delete operation failed: {operation} for {item_id} - {str(e)}")
            handle_service_error(e, f"delete {operation} for {item_id}")
            # This line will never be reached due to handle_service_error raising an exception
            return create_success_response(message="Delete operation failed", data={}) 