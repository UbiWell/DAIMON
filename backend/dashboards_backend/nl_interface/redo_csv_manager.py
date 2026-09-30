import pandas as pd
import os
from datetime import datetime
from typing import Optional, Dict, Any


class CSVViewManager:
    """
    A class to manage a CSV file with viewID, query, refresh_time, code_file_name, and image_csv_file_name fields using pandas.
    """

    def __init__(self, csv_file_path: str):
        """
        Initialize the CSVViewManager with the path to the CSV file.

        Args:
            csv_file_path (str): Path to the CSV file
        """
        self.csv_file_path = csv_file_path
        self.columns = ['viewID', 'query', 'refresh_time', 'code_file_name', 'image_csv_file_name']

        # Create the CSV file with headers if it doesn't exist, otherwise load existing data
        if not os.path.exists(csv_file_path):
            self._create_empty_csv()

        # Load the DataFrame
        self._load_dataframe()

    def _create_empty_csv(self):
        """Create a new empty CSV file with the required headers."""
        empty_df = pd.DataFrame(columns=self.columns)
        empty_df.to_csv(self.csv_file_path, index=False)

    def _load_dataframe(self):
        """Load the CSV file into a DataFrame."""
        try:
            self.df = pd.read_csv(self.csv_file_path)
            # Ensure all required columns exist
            for col in self.columns:
                if col not in self.df.columns:
                    self.df[col] = ''
        except Exception as e:
            print(f"Error loading CSV file: {e}")
            self.df = pd.DataFrame(columns=self.columns)

    def _save_dataframe(self):
        """Save the current DataFrame to the CSV file."""
        try:
            self.df.to_csv(self.csv_file_path, index=False)
            return True
        except Exception as e:
            print(f"Error saving CSV file: {e}")
            return False

    def add_row(self, view_id: str, query: str, code_file_name: str,
                image_csv_file_name: str, refresh_time: Optional[str] = None) -> bool:
        """
        Add a new row to the CSV file.

        Args:
            view_id (str): Unique identifier for the view
            query (str): Query string
            code_file_name (str): Name of the code file
            image_csv_file_name (str): Name of the image CSV file
            refresh_time (Optional[str]): Refresh time (defaults to current timestamp)

        Returns:
            bool: True if row was added successfully, False otherwise
        """
        try:
            # Check if viewID already exists
            if self._view_id_exists(view_id):
                print(f"Warning: ViewID '{view_id}' already exists. Row not added.")
                return False

            # Use current timestamp if refresh_time is not provided
            if refresh_time is None:
                refresh_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

            # Create new row as a DataFrame
            new_row = pd.DataFrame({
                'viewID': [view_id],
                'query': [query],
                'refresh_time': [refresh_time],
                'code_file_name': [code_file_name],
                'image_csv_file_name': [image_csv_file_name]
            })

            # Concatenate with existing DataFrame
            self.df = pd.concat([self.df, new_row], ignore_index=True)

            # Save to file
            if self._save_dataframe():
                print(f"Row with viewID '{view_id}' added successfully.")
                return True
            else:
                # Reload DataFrame if save failed
                self._load_dataframe()
                return False

        except Exception as e:
            print(f"Error adding row: {e}")
            # Reload DataFrame in case of error
            self._load_dataframe()
            return False

    def delete_by_view_id(self, view_id: str) -> bool:
        """
        Delete a row from the CSV file by viewID.

        Args:
            view_id (str): The viewID of the row to delete

        Returns:
            bool: True if row was deleted successfully, False otherwise
        """
        try:
            # Check if viewID exists
            if not self._view_id_exists(view_id):
                print(f"ViewID '{view_id}' not found.")
                return False

            # Get initial row count
            initial_count = len(self.df)

            # Remove rows with matching viewID
            self.df = self.df[self.df['viewID'] != view_id]

            # Check if any rows were actually deleted
            if len(self.df) == initial_count:
                print(f"No rows were deleted for viewID '{view_id}'.")
                return False

            # Save to file
            if self._save_dataframe():
                print(f"Row with viewID '{view_id}' deleted successfully.")
                return True
            else:
                # Reload DataFrame if save failed
                self._load_dataframe()
                return False

        except Exception as e:
            print(f"Error deleting row: {e}")
            # Reload DataFrame in case of error
            self._load_dataframe()
            return False

    def _view_id_exists(self, view_id: str) -> bool:
        """
        Check if a viewID already exists in the DataFrame.

        Args:
            view_id (str): The viewID to check

        Returns:
            bool: True if viewID exists, False otherwise
        """
        return view_id in self.df['viewID'].values

    def get_all_rows(self) -> pd.DataFrame:
        """
        Get all rows from the CSV file as a pandas DataFrame.

        Returns:
            pd.DataFrame: All rows as a DataFrame
        """
        return self.df.copy()

    def get_all_rows_dict(self) -> list[Dict[str, Any]]:
        """
        Get all rows from the CSV file as a list of dictionaries.

        Returns:
            list[Dict[str, Any]]: All rows as a list of dictionaries
        """
        return self.df.to_dict('records')

    def get_by_view_id(self, view_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific row by viewID.

        Args:
            view_id (str): The viewID to search for

        Returns:
            Optional[Dict[str, Any]]: The row as a dictionary if found, None otherwise
        """
        try:
            matching_rows = self.df[self.df['viewID'] == view_id]
            if matching_rows.empty:
                return None
            return matching_rows.iloc[0].to_dict()
        except Exception as e:
            print(f"Error searching for viewID: {e}")
            return None

    def update_by_view_id(self, view_id: str, **kwargs) -> bool:
        """
        Update specific fields of a row by viewID.

        Args:
            view_id (str): The viewID of the row to update
            **kwargs: Field names and their new values

        Returns:
            bool: True if row was updated successfully, False otherwise
        """
        try:
            if not self._view_id_exists(view_id):
                print(f"ViewID '{view_id}' not found.")
                return False

            # Update the specified fields
            for field, value in kwargs.items():
                if field in self.columns and field != 'viewID':  # Don't allow updating viewID
                    self.df.loc[self.df['viewID'] == view_id, field] = value
                elif field != 'viewID':
                    print(f"Warning: Field '{field}' is not a valid column.")

            # Save to file
            if self._save_dataframe():
                print(f"Row with viewID '{view_id}' updated successfully.")
                return True
            else:
                # Reload DataFrame if save failed
                self._load_dataframe()
                return False

        except Exception as e:
            print(f"Error updating row: {e}")
            # Reload DataFrame in case of error
            self._load_dataframe()
            return False

    def get_dataframe_info(self):
        """Print information about the current DataFrame."""
        print(f"CSV file: {self.csv_file_path}")
        print(f"Number of rows: {len(self.df)}")
        print(f"Columns: {list(self.df.columns)}")
        if not self.df.empty:
            print("\nFirst few rows:")
            print(self.df.head())


# Example usage
if __name__ == "__main__":
    # Initialize the manager
    pass
    # manager = CSVViewManager("views.csv")
    #
    # # Add some sample rows
    # manager.add_row("view001", "SELECT * FROM users", "user_query.py", "user_data.csv")
    # manager.add_row("view002", "SELECT name FROM products", "product_query.py", "product_data.csv")
    #
    # # Display DataFrame info
    # manager.get_dataframe_info()
    #
    # # Get specific row
    # print("\nSpecific row (view001):")
    # print(manager.get_by_view_id("view001"))
    #
    # # Update a row
    # manager.update_by_view_id("view001", query="SELECT id, name FROM users WHERE active=1")
    #
    # # Get all rows as DataFrame
    # print("\nAll rows as DataFrame:")
    # print(manager.get_all_rows())
    #
    # # Delete a row
    # manager.delete_by_view_id("view001")
    #
    # # Final state
    # print("\nFinal DataFrame info:")
    # manager.get_dataframe_info()