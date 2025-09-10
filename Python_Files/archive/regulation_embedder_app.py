import os
import sys
import streamlit as st
from dotenv import load_dotenv
from typing import Optional
from langchain_community.vectorstores import SupabaseVectorStore
from supabase import create_client
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import AzureOpenAIEmbeddings

# Load environment variables
load_dotenv()

# Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase = create_client(supabase_url, supabase_key)

# Embeddings
embeddings = AzureOpenAIEmbeddings(
    model=os.getenv("AZURE_EMBEDDING_MODEL_NAME"),
    azure_endpoint=os.getenv("AZURE_EMBEDDING_ENDPOINT"),
    openai_api_key=os.getenv("AZURE_EMBEDDING_API_KEY"),
    openai_api_version="2024-02-01",
)

def build_vectorstore(file_paths: list[str], regulator_code: str) -> Optional[SupabaseVectorStore]:
    """Load PDFs, chunk them, and build a Supabase vectorstore in regulation_embd."""
    if not file_paths:
        st.error("❌ No PDF files uploaded.")
        return None

    documents = []
    for file_path in file_paths:
        loader = PyPDFLoader(file_path)
        documents.extend(loader.load())

    if not documents:
        st.warning("⚠️ No valid PDF documents found.")
        return None

    # Split into chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    docs = text_splitter.split_documents(documents)

    # Add regulator_code metadata
    for doc in docs:
        doc.metadata["regulator_code"] = regulator_code

    st.success(f"✅ Prepared {len(docs)} chunks for {regulator_code} regulations")

    # Push into Supabase
    vs = SupabaseVectorStore.from_documents(
        docs,
        embeddings,
        client=supabase,
        table_name="regulation_embd",
        query_name="match_documents",
    )
    return vs

# ------------------ Streamlit UI ------------------
st.title("📘 Regulation Embedding Uploader")

# User inputs
regulation_name = st.text_input("Enter Regulation Name (e.g. FAA):", value="FAA")

uploaded_files = st.file_uploader(
    "📂 Upload your PDF files",
    type=["pdf"],
    accept_multiple_files=True
)

file_paths = []
if uploaded_files:
    save_dir = "./uploaded_pdfs"
    os.makedirs(save_dir, exist_ok=True)

    for uploaded_file in uploaded_files:
        file_path = os.path.join(save_dir, uploaded_file.name)
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        file_paths.append(file_path)

    st.success(f"✅ {len(file_paths)} PDFs saved to {save_dir}")

if st.button("🚀 Start Embedding"):
    with st.spinner("Processing PDFs and uploading embeddings..."):
        vs = build_vectorstore(file_paths, regulation_name.lower())
        if vs:
            st.success(f"🎉 {regulation_name} embeddings uploaded to Supabase table: regulation_embd")
        else:
            st.error("❌ Could not build vectorstore. Please check your PDFs.")
